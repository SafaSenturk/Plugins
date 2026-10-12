// DleEngine — "Loldle / Wordle" tarzı tahmin oyunu motoru (saf Kotlin).
// gamedle'daki GameViewModel mantığının arayüzden ve Android'den bağımsız hâli.
// Paket adını kendi projenize göre değiştirin.
package com.example.dle

import java.time.LocalDate
import java.util.Locale
import kotlin.random.Random

enum class CellState { CORRECT, PARTIAL, WRONG }
enum class Direction { HIGHER, LOWER }

/** type = "number" ise yön (HIGHER: doğru cevap daha büyük) hesaplanır. */
data class Attribute(val key: String, val label: String = key, val type: String = "set")

data class Entity(val name: String, val imageUrl: String = "", val attributes: Map<String, String>)

data class Cell(
    val key: String,
    val label: String,
    val value: String,
    val state: CellState,
    val direction: Direction? = null
)

data class GuessRow(val name: String, val imageUrl: String, val correct: Boolean, val cells: List<Cell>)

sealed class GuessResult {
    data class Ok(val row: GuessRow, val won: Boolean, val lost: Boolean) : GuessResult()
    object Unknown : GuessResult()
    object Duplicate : GuessResult()
    object Finished : GuessResult()
}

class DleEngine(
    entities: List<Entity>,
    private val attributes: List<Attribute>,
    daily: Boolean = false,
    date: LocalDate = LocalDate.now(),
    salt: String = "",
    private val maxGuesses: Int = 0,          // 0 = sınırsız
    answerName: String? = null,
    random: Random = Random.Default
) {
    private val sorted = entities.sortedBy { it.name.lowercase(TR) }
    private val byName = sorted.associateBy { norm(it.name) }
    private val answer: Entity
    private val _history = mutableListOf<GuessRow>()

    val history: List<GuessRow> get() = _history.toList()
    var won = false; private set
    var lost = false; private set
    val finished get() = won || lost
    val guessesLeft get() = if (maxGuesses > 0) maxOf(0, maxGuesses - _history.size) else Int.MAX_VALUE
    /** Oyun bitmeden null döner (cevap ekrana sızmasın). */
    val revealedAnswer: Entity? get() = if (finished) answer else null
    val names: List<String> get() = sorted.map { it.name }

    init {
        require(sorted.isNotEmpty()) { "DleEngine: liste boş" }
        answer = answerName?.let { byName[norm(it)] }
            ?: if (daily) sorted[dailyIndex(sorted.size, date, salt)] else sorted[random.nextInt(sorted.size)]
    }

    fun guess(name: String): GuessResult {
        if (finished) return GuessResult.Finished
        val e = byName[norm(name)] ?: return GuessResult.Unknown
        if (_history.any { it.name == e.name }) return GuessResult.Duplicate
        val row = GuessRow(e.name, e.imageUrl, e === answer, attributes.map { cell(e, it) })
        _history.add(row)
        if (row.correct) won = true
        else if (maxGuesses > 0 && _history.size >= maxGuesses) lost = true
        return GuessResult.Ok(row, won, lost)
    }

    fun giveUp(): String { if (!won) lost = true; return answer.name }

    /** Yazarken öneri: önce adı yazılanla başlayanlar, sonra içerenler. */
    fun suggest(text: String, limit: Int = 8): List<String> {
        val q = norm(text)
        if (q.isEmpty()) return emptyList()
        val used = _history.map { it.name }.toSet()
        val pool = sorted.filter { it.name !in used }
        val starts = pool.filter { norm(it.name).startsWith(q) }
        val has = pool.filter { !norm(it.name).startsWith(q) && norm(it.name).contains(q) }
        return (starts + has).take(limit).map { it.name }
    }

    fun shareText(title: String = "Tahmin"): String {
        fun icon(c: Cell) = when {
            c.state == CellState.CORRECT -> "🟩"
            c.state == CellState.PARTIAL -> "🟨"
            c.direction == Direction.HIGHER -> "⬆️"
            c.direction == Direction.LOWER -> "⬇️"
            else -> "🟥"
        }
        val score = (if (won) _history.size.toString() else "X") + (if (maxGuesses > 0) "/$maxGuesses" else "")
        return "$title $score\n" + _history.joinToString("\n") { r -> r.cells.joinToString("") { icon(it) } }
    }

    private fun cell(guessed: Entity, a: Attribute): Cell {
        val g = guessed.attributes[a.key]
        val ans = answer.attributes[a.key]
        val shown = split(g).joinToString(", ").ifEmpty { "—" }
        val (state, dir) = compareValue(g, ans, a.type)
        return Cell(a.key, a.label, shown, state, dir)
    }

    companion object {
        private val TR = Locale("tr")
        private fun norm(s: String?) = (s ?: "").trim().lowercase(TR)
        private fun split(v: String?) = (v ?: "").split("|").map { it.trim() }.filter { it.isNotEmpty() }

        /** Çoklu değer "|" ile: hepsi aynı = CORRECT, en az biri ortak = PARTIAL. */
        fun compareValue(guess: String?, answer: String?, type: String = "set"): Pair<CellState, Direction?> {
            if (type == "number") {
                val g = guess?.trim()?.toDoubleOrNull()
                val a = answer?.trim()?.toDoubleOrNull()
                if (g == null || a == null) return (if (norm(guess) == norm(answer)) CellState.CORRECT else CellState.WRONG) to null
                if (g == a) return CellState.CORRECT to null
                return CellState.WRONG to (if (a > g) Direction.HIGHER else Direction.LOWER)
            }
            val gs = split(guess).map { norm(it) }.toSet()
            val ans = split(answer).map { norm(it) }.toSet()
            return when {
                gs == ans -> CellState.CORRECT to null
                gs.any { it in ans } -> CellState.PARTIAL to null
                else -> CellState.WRONG to null
            }
        }

        /** Tarihe bağlı, her cihazda aynı indeks (FNV-1a). JS sürümüyle aynı sonucu verir. */
        fun dailyIndex(n: Int, date: LocalDate = LocalDate.now(), salt: String = ""): Int {
            if (n <= 0) return -1
            val s = "%04d-%02d-%02d|%s".format(date.year, date.monthValue, date.dayOfMonth, salt)
            var h = 0x811c9dc5.toInt()
            for (ch in s) { h = h xor ch.code; h *= 0x01000193 }
            return ((h.toLong() and 0xffffffffL) % n).toInt()
        }
    }
}
