# orb3d

Tuvale (canvas) elle çizilen **hareketli 3B tel kafes nesneler** ve gerçek kıtalarıyla bir **dünya küresi**.
Portföydeki giriş küresinden (`#orb`) genelleştirildi. Tek dosya, bağımlılık yok, WebGL gerekmez.
Orta seviye bir bilgisayarda 60 fps çalışır.

| Dosya | |
|---|---|
| `orb3d.js` | Kullanacağınız dosya (dünya verisi içinde gömülü, ~63 KB) |
| `demo.html` | Dünya + şekil galerisi örneği. Tarayıcıda doğrudan açılır |
| `orb3d.src.js`, `tools/build.js` | Kaynak ve veriyi gömen araç. Yalnızca motoru değiştirirken gerekir |

## Dünya

```html
<canvas id="globe" style="width:600px;aspect-ratio:1"></canvas>
<script src="orb3d.js"></script>
<script>
  const world = Orb3D.globe(document.getElementById("globe"), {
    markers: [{ lat: 41.01, lon: 28.98, label: "İstanbul" }, { lat: 52.52, lon: 13.40, label: "Berlin" }],
    arcs: [{ from: [41.01, 28.98], to: [52.52, 13.40] }],
    rings: [{ radius: 1.28, tilt: [1.2, 0.3], color: "accent", spin: { axis: "y", speed: 0.15 } }],
    scroll: "#intro"          // o bölüm kaydırıldıkça döner, büyür, solar
  });
  world.focus(35.68, 139.69);  // Tokyo'yu öne çevir
</script>
```

- Kıtalar noktalı doku ve kıyı çizgileriyle çizilir; veri Natural Earth 1:110m (kamu malı).
- Kürenin arkasında kalan çizgi, nokta, işaret ve yaylar gizlenir. Kenara yaklaşanlar solar.
- **Sürükleyerek çevrilir**, bırakınca süzülerek yavaşlar. Telefonda dokunmayla da çalışır; sayfa kaydırması bozulmaz.
- İşaretler nabız gibi atar. Yazıları çakışırsa öndeki gösterilir.
- Yaylar iki şehir arasında kavis çizer, üstlerinde bir ışık yürür.

| Seçenek | Varsayılan | |
|---|---|---|
| `speed` | `0.08` | Dönüş hızı, gerçek dünya yönünde (0 = durur) |
| `viewLat` / `startLon` | `22` / `30` | Açılışta ortadaki enlem / boylam |
| `dots`, `coast`, `graticule`, `outline` | `true` | Kara noktaları, kıyı çizgisi, enlem-boylam ağı, kenar çizgisi |
| `dotSpacing` / `dotSize` | `1.6` / `1.6` | Nokta aralığı (derece) / boyutu |
| `seeThrough` | `false` | Arka yüz soluk görünsün |
| `colors` | `{ line, accent, land, label }` | `#hex` ya da `"r,g,b"` |

`Orb3D.isLand(lat, lon)` bir noktanın karada olup olmadığını söyler (1° çözünürlük).

## Herhangi bir şekil

```js
const S = Orb3D.shapes;
const orb = Orb3D.create(canvas, {
  shapes: [S.sphere(), S.ring({ radius: 1.34, tilt: [1.05, 0.35], color: "accent" }), S.ring({ radius: 1.55, tilt: [-0.6, -0.5] })],
  scroll: heroEl
});   // ← portföydeki giriş küresinin aynısı
```

Hazır şekiller: `sphere`, `ring`, `torus`, `cube`, `octahedron`, `icosahedron`, `spiral`, `stars`, `graticule`, `geoLines`, `poly(köşeler, kenarlar)`.
Hepsi `{ radius, tilt: [x, z], color, alpha, width, spin: { axis, speed } }` alır.

Kendi şekliniz birim küreye göre koordinat listesidir:
```js
orb.add({ lines: [[0,-1,0, 0,1,0], [-1,0,0, 1,0,0]], color: "accent" });   // bir artı işareti
orb.add({ points: [0,0,-1.2, 0.5,0.5,-1], dot: 3 });
```

## Genel seçenekler

`size` (0.32), `perspective` (3.4), `tilt`, `autoRotate`, `follow` (fareyi hafifçe takip eder, `true`),
`drag`, `scroll` + `scrollEffect: { spin, tilt, scale, fade }`, `pauseOffscreen` (`true`), `reducedMotion` (`"respect"`).

Ekranda görünmezken ve sekme gizliyken çizim durur. "Hareketi azalt" ayarı açık olan kullanıcılarda küre dönmez; sürükleme ve `focus` çalışmaya devam eder.

Metotlar: `add`, `remove`, `clear`, `addMarker`, `removeMarker`, `addArc`, `removeArc`, `focus(lat, lon)`, `resume()`,
`setProgress(0..1)`, `pause()`, `play()`, `render()`, `destroy()`.

## Veriyi yeniden üretmek
```
npm i world-atlas@2 topojson-client@3
node tools/build.js node_modules/world-atlas/land-110m.json
```
