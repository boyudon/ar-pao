# ตั้งค่า Firebase — เก็บรายชื่อ+คะแนน และแลกของรางวัล

เกม **พายเรือเก็บบัวแดง** เล่นได้เลยแบบออฟไลน์ (คะแนน/รางวัลเก็บในเครื่องนักเรียนแต่ละคน)
ถ้าอยากให้ **คุณครูเห็นรายชื่อ+คะแนนของทุกคนแบบสด** และจัดการการแลกของรางวัล ให้เปิดระบบออนไลน์ด้วย Firebase (ฟรี) ตามขั้นตอนนี้ — ทำครั้งเดียวจบ ใช้เวลา ~10 นาที

---

## ขั้นตอน

### 1) สร้างโปรเจกต์ Firebase
1. เข้า https://console.firebase.google.com/ แล้วล็อกอินด้วยบัญชี Google ของโรงเรียน/คุณครู
2. กด **Add project / เพิ่มโปรเจกต์** ตั้งชื่อ เช่น `buadaeng-udon` → กดถัดไปจนเสร็จ (ปิด Google Analytics ได้ ไม่จำเป็น)

### 2) สร้างฐานข้อมูล Firestore
1. เมนูซ้าย **Build → Firestore Database → Create database**
2. เลือก **Start in production mode** → เลือก location `asia-southeast1 (Singapore)` → เปิดใช้งาน

### 3) เพิ่มเว็บแอปเพื่อเอาค่า config
1. หน้า Project Overview กดไอคอน **`</>` (Web)**
2. ตั้งชื่อเล่นแอป เช่น `game` → **Register app** (ไม่ต้องติดตั้ง Hosting)
3. จะเห็นโค้ด `const firebaseConfig = { apiKey: "...", ... }` — **คัดลอกเฉพาะในวงเล็บปีกกา** ไว้

### 4) วางค่า config ลงในเกม (แก้ไฟล์เดียว)
เปิดไฟล์ **`js/firebase-config.js`** แล้ววางค่าที่คัดลอกมา ให้เป็นแบบนี้:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza........",
  authDomain: "buadaeng-udon.firebaseapp.com",
  projectId: "buadaeng-udon",
  storageBucket: "buadaeng-udon.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

> ทั้งเกม (`game.html`) และหน้าคุณครู (`teacher.html`) ใช้ไฟล์นี้ร่วมกัน แก้ที่เดียวพอ

### 5) ตั้งกฎความปลอดภัย (Rules)
ไปที่ **Firestore Database → แท็บ Rules** วางกฎนี้แล้วกด **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ตารางคะแนนผู้เล่น: อ่านได้ทุกคน, เขียนได้เฉพาะข้อมูลที่ถูกรูปแบบ
    match /players/{pid} {
      allow read: if true;
      allow write: if request.resource.data.name is string
                   && request.resource.data.name.size() <= 20
                   && request.resource.data.hi is number
                   && request.resource.data.hi <= 100000000;
    }
    // การแลกของรางวัล: อ่าน/เขียนได้ (สำหรับงานอีเวนต์ระยะสั้น)
    match /claims/{code} {
      allow read: if true;
      allow write: if request.resource.data.name is string
                   && request.resource.data.name.size() <= 20;
    }
  }
}
```

> กฎนี้เปิดให้ "เขียนได้แบบไม่ต้องล็อกอิน" เพื่อให้นักเรียนส่งคะแนนง่าย เหมาะกับงานวันเดียว/สัปดาห์เดียว
> **หลังจบงาน** แนะนำให้กลับมาแก้ Rules เป็น `allow write: if false;` เพื่อปิดการเขียน หรือลบข้อมูลทิ้ง

### 6) เสร็จแล้ว! ทดสอบ
- เปิด `game.html` บนมือถือ → ลงทะเบียนชื่อ → เล่น → กด **🏆 ตารางแชมป์ → แท็บ 🌐 ออนไลน์** ต้องเห็นชื่อตัวเอง
- เปิด `teacher.html` บนเครื่องคุณครู → เห็นรายชื่อ+คะแนนทุกคน และแท็บ **🎁 การแลกรางวัล**

---

## หน้าคุณครู (teacher.html) ทำอะไรได้
- **🏆 คะแนนนักเรียน** — อันดับสด ชื่อ/ห้อง/ดาว/ตรา/คะแนนสะสม ค้นหาได้ ดาวน์โหลด CSV
- **🎁 การแลกรางวัล** — เห็นว่าใครปลดล็อกรางวัลอะไร กดปุ่ม **✓ จ่ายแล้ว** เมื่อมอบของ (กันแจกซ้ำ)
- นักเรียนโชว์ **คูปอง QR** ที่บูธ → คุณครูสแกน QR จะเปิด `teacher.html?claim=CODE` ไฮไลต์รายการนั้นให้เลย

## เกณฑ์ของรางวัล (แก้ได้)
เปิด `game.html` หาบรรทัด `const PRIZES = [` แล้วแก้ชื่อ/เกณฑ์คะแนนได้ตามของจริงที่โรงเรียนเตรียมไว้
(ปลดล็อกตาม "คะแนนสะสมรวม" — คะแนนไม่ถูกหักเมื่อรับรางวัล)

## ความเป็นส่วนตัว
- เก็บแค่ **ชื่อเล่น + ห้อง** ไม่เก็บชื่อจริง/เลขนักเรียน/ข้อมูลอ่อนไหว
- แนะนำแจ้งนักเรียนให้ใช้ชื่อเล่น และลบข้อมูลใน Firestore ทิ้งหลังจบกิจกรรม
