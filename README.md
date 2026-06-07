# 3D Fizika va Elektr Laboratoriyasi

Interaktiv Three.js laboratoriyasi. O'quvchi batareya, kalit, lampochka, rezistor va elektrod klemmasini sim bilan ulab, zanjir natijasini 3D sahnada ko'radi.

## Ishga tushirish

```bash
npm install
npm start
```

Brauzerda ochish:

```text
http://localhost:4173
```

`index.html` bitta sahifa sifatida ham ishlaydi, lekin CDN orqali Three.js yuklanishi uchun internet kerak bo'lishi mumkin.

## Tajribalar

- Lampochkani yoqish: batareya, kalit va lampochkani ketma-ket ulang, keyin kalitni bosing.
- Qisqa tutashuv: batareyaning `+` va `-` klemmasini bevosita ulang.
- Suv elektrolizi: batareyani elektrod klemmasiga ulang.
- Parallel zanjir: ikkita lampochkani batareya klemmasiga parallel ulang.
- Ohm qonuni: batareya, rezistor va lampochkani ketma-ket ulang, `- R` va `+ R` tugmalari bilan qarshilikni o'zgartiring.
- LED qutblanishi: batareya, rezistor va LED ni ulang. LED faqat to'g'ri qutbda yonadi.
- Elektr motor: batareya, kalit va motorni ulang. Kalit yopilganda parrak aylanadi.

## Boshqaruv

- Chap tugma: klemma ustidan bosib, boshqa klemmaga sim tortish.
- O'ng tugma: kamerani aylantirish.
- Scroll: yaqinlashtirish yoki uzoqlashtirish.

## Validatsiya rejasi

1. Har bir tajribani tanlang va eski simlar tozalanishini tekshiring.
2. Lampochka tajribasida to'g'ri ulanishdan keyin faqat kalit bosilganda lampa yonishini tekshiring.
3. Parallel zanjirda batareyaning bitta klemmasidan ikki sim chiqishini va ikkala lampaning alohida yonishini tekshiring.
4. Ohm tajribasida qarshilik o'zgarganda amper va quvvat ko'rsatkichlari qayta hisoblanishini tekshiring.
5. LED tajribasida LED teskari ulanganda qo'llanma xato sababini ko'rsatishini tekshiring.
6. Motor tajribasida kalit bosilganda rotor aylanishini tekshiring.
7. Mobil o'lchamda panel va metrlar sahnani to'liq yopib qo'ymasligini tekshiring.

## Keyin sozlash joylari

- Tajriba sahnalari: `loadExperiment(type)`.
- Yangi qurilma qo'shish: `spawnBattery`, `spawnLamp`, `spawnResistor`, `spawnElectrolysis` kabi funksiyalar yoniga yangi `spawn...` funksiyasi qo'shing.
- Zanjir mantiqi: `calculateCircuit()`.
- Xato bo'lganda chiqadigan yordam matnlari: `setGuide(...)` chaqiriqlari.
- Sim va obyekt ko'rinishi: `MAT`, `buildWireGeo()`, CSS panel stillari.
- Metr diapazonlari: `updateMeters(v, a)`.
