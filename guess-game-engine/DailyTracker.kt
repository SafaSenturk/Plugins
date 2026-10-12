// "Bugünün oyunu oynandı mı?" — Jetpack DataStore ile.
// gamedle'daki UserPreferencesRepository'nin oyun adına bağlı olmayan hâli:
// her oyun kimliği için ayrı anahtar kendiliğinden oluşur.
// Gerekli bağımlılık: androidx.datastore:datastore-preferences
package com.example.dle

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.time.LocalDate

private val Context.dleStore: DataStore<Preferences> by preferencesDataStore(name = "dle_daily")

class DailyTracker(private val context: Context) {
    private fun key(gameId: String) = stringPreferencesKey("last_played_$gameId")
    private fun today() = LocalDate.now().toString()   // yyyy-MM-dd

    suspend fun hasPlayedToday(gameId: String): Boolean =
        context.dleStore.data.map { it[key(gameId)] }.first() == today()

    /** Arayüzde canlı göstermek için (ör. "Yarın yeni karakter" rozeti) */
    fun playedTodayFlow(gameId: String): Flow<Boolean> =
        context.dleStore.data.map { it[key(gameId)] == today() }

    suspend fun markPlayed(gameId: String) {
        context.dleStore.edit { it[key(gameId)] = today() }
    }
}
