
# Bizim Oyun — Uygulama Planı

Sadece Ozzy ve partneri için, tek HTML dosyasında çalışan, framework'süz bir çift oyunu. Tüm veri tarayıcıda (localStorage). "Sürekli yeni ve yaratıcı sorular" için Lovable AI Gateway (Gemini) ile dinamik üretim; sabit bir çekirdek havuz da her zaman offline çalışsın diye gömülü.

## Mimari

- `public/bizim-oyun.html` — tek dosya: HTML + CSS + vanilla JS (modül). Site içinden `/bizim-oyun.html` yolundan açılıyor, ayrıca ana sayfadan (`/`) buraya yönlendirme.
- AI üretimi için minimal bir server route: `src/routes/api/public/bizim-oyun-generate.ts` (POST). Sebep: `LOVABLE_API_KEY` tarayıcıda açılamaz; tek dosya HTML `fetch("/api/public/bizim-oyun-generate")` ile çağırır. Bu tek istisna dışında hiçbir sunucu iletişimi yok.
- Depolama: tamamen `localStorage` (kartlar, oturum kayıtları, ayarlar, özel kartlar, AI üretilen ek kartlar). JSON export/import.

```
public/bizim-oyun.html          ← tüm UI + oyun mantığı (tek dosya)
src/routes/api/public/
  bizim-oyun-generate.ts        ← sadece AI üretim proxy'si (Gemini)
src/routes/index.tsx            ← /bizim-oyun.html'e yönlendirme
```

Tek dosya kısıtı: kullanıcı isterse `bizim-oyun.html`'i indirip herhangi bir yerde açabilir — offline modda sabit havuz devrede, AI butonları "çevrimiçi gerekli" uyarısı verir.

## Modüller (tek dosya içinde sekmeler)

1. **Ana ekran** — çark (rastgele seviye), günün sorusu, modül kartları.
2. **Seviye kartları** — Isınma / Flört / Yakınlaşma / Anılarımız. Her seviyede sabit ~40 kart + "Yeni sorular üret" (AI) butonu.
3. **6 Parti oyunu** — Doğruluk mu Cesaret mi, Ben kimim, Tabu-lite, Sessiz sinema ipuçları, Hızlı ateş, Hikaye tamamla. Her biri kısa kural + kart çekme.
4. **OK mu NOK mu?** — 80 kart. İki oyuncu telefonu sırayla alır, gizli cevap verir (ekran kapalı geçiş), sonra "birlikte aç" ile karşılaştırma.
5. **Beni Tahmin Et** — 106 soru. Oyuncu 1 kendisi için cevaplar → Oyuncu 2 tahmin eder → skor.
6. **Sex Zarı** — 10 havuz (oyuncu, eylem, vücut bölgesi, pozisyon [80], tarz, tempo, süre, yer, kural, sürpriz). 5 mod: Klasik / Yavaş / Vahşi / Rulet / Özel Kasa. Zar animasyonu (CSS).
7. **Oturum özeti** — kim kaç tur, kaç pas, hangi modüller. Yargısız dil. Uyumluluk yüzdesi YOK.
8. **Ayarlar** — içerik tercihleri (kategori aç/kapa, sertlik seviyesi 1-5), özel kart ekle/sil, JSON export/import, tüm veriyi sıfırla.

## İçerik havuzu (sabit + AI)

- Sabit gömülü havuz: seviyeler ~160, OK/NOK 80, Beni Tahmin Et 106, Sex Zarı havuzları (80 pozisyon dahil), 6 parti oyunu için ~30'ar kart. Türkçe, ikinci tekil şahıs. Rıza/pas dili gömülü.
- Her modülde **"Yeni sorular üret"** butonu → server route'a POST (modül, seviye, kaç adet, mevcut kart özetleri/başlıkları — tekrar önleme). Dönen JSON kartlar localStorage'a eklenir ve "AI üretimi" rozeti ile işaretlenir.
- Tekrar önleme: her kartın `id`'si (hash), gösterilenler `seen` setinde tutulur; havuz biterse önce AI, sonra tekrar.

## AI üretim endpoint'i

`POST /api/public/bizim-oyun-generate` — body: `{ module, level, count, avoidTitles[] }`.
- `LOVABLE_API_KEY` sunucu tarafında okunur.
- Model: `google/gemini-3.5-flash` (hızlı, yaratıcı, ucuz).
- AI SDK + `@ai-sdk/openai-compatible` üzerinden `generateText` + `Output.object` (küçük şema: `{ cards: [{title, prompt, tags[]}] }`, sınır ifadeleri prompt'ta).
- Sistem prompt'u: iki yetişkin çift için, rızaya saygılı, yargısız, Türkçe, sertlik seviyesine göre üslup. `avoidTitles` verilenleri üretme.
- Hata durumları (429/402) UI'da net gösterilir; offline'a düşer.

## UI/UX

- Karanlık, sıcak palet (bordo/altın), büyük dokunmatik hedefler (telefonda oynanacak).
- "Ekranı partnerine ver" geçiş ekranları OK/NOK ve Beni Tahmin Et'te.
- Pas hakkı her kartta görünür. Rıza hatırlatması modül başlangıcında bir kez.
- Çark ve zar için saf CSS/JS animasyon.

## Veri modeli (localStorage)

```
bizimOyun.settings         { hardness:1-5, enabledModules, enabledCategories }
bizimOyun.pool.<module>    [{id, title, prompt, tags, source:'core'|'ai'|'custom'}]
bizimOyun.seen.<module>    [id...]
bizimOyun.custom           [{module, ...card}]
bizimOyun.sessions         [{date, module, rounds, passes, players}]
bizimOyun.dailyQuestion    { date, id }
```

Export = tüm anahtarların birleştirilmiş JSON'u; import = birleşme veya değiştirme seçeneği.

## Teknik notlar

- `bizim-oyun.html` tek dosya; hiçbir dış CDN yüklemez (offline çalışsın). Fontlar system stack.
- `/` sayfası kısa bir açılış + "Oyuna başla" butonu, `bizim-oyun.html`'e gider (aynı origin, direkt indirilebilir dosya).
- SEO/head: root'ta uygun başlık ("Bizim Oyun — Ozzy & partneri için").
- AI endpoint `api/public/` altında; kimlik kontrolü yok (uygulama zaten sadece bilinen URL'yi bilenler için). İstenirse ileride basit bir paylaşılan token eklenebilir.

## Uygulama sırası

1. AI endpoint (`bizim-oyun-generate.ts`) + Lovable AI gateway helper.
2. `public/bizim-oyun.html` iskeleti: ana ekran, modül router, ayarlar, localStorage yardımcıları.
3. Sabit kart havuzları (gömülü JSON blokları).
4. Seviye kartları + 6 parti oyunu + çark + günün sorusu.
5. OK/NOK + Beni Tahmin Et (gizli-cevap akışı).
6. Sex Zarı (havuzlar, 5 mod, animasyon).
7. Oturum kaydı + gece özeti.
8. AI "yeni sorular üret" entegrasyonu her modüle.
9. Export/import + özel kart yönetimi.
10. `/` yönlendirme + baş metadata.

Onaylarsan implementasyona geçiyorum.
