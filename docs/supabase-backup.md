# สำรองฐานข้อมูล Supabase อัตโนมัติ

สถานะ: เตรียม workflow แล้ว แต่ยังไม่ได้เปิดใช้งานหรือทดสอบกับ Supabase จริง โปรเจกต์ร้านอาหารปัจจุบันยังใช้ SQLite บนเครื่องร้าน ไม่ได้เชื่อม Supabase และ workflow นี้ไม่ได้สำรอง SQLite

## หลักการ

GitHub Actions จะเริ่มสำรองทุกวันเวลา 02:17 น. ประเทศไทย (19:17 UTC ของวันก่อน) และสามารถสั่งรันด้วยมือได้ Workflow ใช้ Supabase CLI แยกสำรอง roles, schema และ data ตามคู่มือ Supabase บีบอัดและเข้ารหัสด้วย GPG AES-256 แล้วอัปโหลดเป็น GitHub Actions artifact อายุ 7 วันนับจากการสร้าง ไม่ใช่การรับประกันว่าจะมีไฟล์สำเร็จครบ 7 ชุดเสมอ งานที่ไม่สำเร็จหรือถูกรันช้าอาจทำให้ไม่มีไฟล์บางวัน

ไฟล์สำรองเก็บใน GitHub แยกจาก Supabase และไม่ถูก commit เข้าประวัติ Git แต่ artifact มีอายุจำกัดและใช้โควตา GitHub Actions ของบัญชี ควรดาวน์โหลดเก็บในที่ปลอดภัยเพิ่มเติมตามความเหมาะสม อย่าพึ่งสำเนาเพียงแห่งเดียว

## ขั้นตอนเปิดใช้งาน

1. สร้าง Supabase project และย้ายระบบร้านไปใช้ Supabase ก่อน ปัจจุบันยังไม่มีฐานข้อมูลร้านบน Supabase ให้สำรอง
2. สร้าง **private repository** บน GitHub และนำโค้ดรวมทั้ง `.github/workflows/supabase-backup.yml` ขึ้น default branch Workflow จะปฏิเสธการรันถ้า repository ไม่ใช่ private ห้ามอัปโหลดข้อมูลสำรองที่ไม่เข้ารหัสไปยัง repository
3. ใน Supabase Dashboard เปิด **Connect** เลือก **Session pooler** แล้วคัดลอก PostgreSQL connection string พร้อมรหัสผ่านฐานข้อมูล GitHub-hosted runner อาจเชื่อม direct endpoint แบบ IPv6 ไม่ได้ ต้องใช้ session pooler ที่รองรับ IPv4 และ URL-encode อักขระพิเศษในรหัสผ่านถ้าจำเป็น
4. ที่ GitHub repository ไปที่ **Settings → Secrets and variables → Actions → New repository secret** สร้าง secret สองรายการ:
   - `SUPABASE_DB_URL`: connection string ของ session pooler พร้อมรหัสผ่านจริง
   - `BACKUP_PASSPHRASE`: รหัสผ่านเข้ารหัสที่ยาวและไม่ซ้ำกับรหัสฐานข้อมูล
5. เก็บ `BACKUP_PASSPHRASE` อีกชุดใน password manager ที่ปลอดภัยแยกจาก GitHub หากทำหายจะเปิดไฟล์ไม่ได้ อย่าส่งรหัสผ่านหรือ connection string ในแชตหรือ commit ลง Git
6. ไปที่ **Actions → Encrypted Supabase backup → Run workflow** ตรวจว่า job สำเร็จและมี artifact จากนั้นดาวน์โหลดและทดสอบถอดรหัสกับกู้คืนลงฐานข้อมูลทดลองก่อนใช้งานจริง หาก Actions ปิดอยู่ ให้เปิดใช้งานใน repository ก่อน
7. ติดตามสถานะงานและพื้นที่ artifact อย่างสม่ำเสมอ งานตามเวลาอาจล่าช้าหรือไม่ทำงาน และ Supabase Free อาจพักโปรเจกต์เมื่อไม่ใช้งาน หากเกิดข้อผิดพลาดจะไม่มี artifact ใหม่

## เปิดไฟล์และทดสอบกู้คืน

ใช้เครื่องที่เชื่อถือได้และมี GPG, tar, psql และ Supabase CLI ติดตั้งอยู่ โหลด artifact จากหน้า workflow แล้วแตก zip ที่ GitHub ให้ก่อน จากนั้นใน terminal ที่รองรับคำสั่งต่อไปนี้:

```sh
gpg --output supabase-backup.tar.gz --decrypt supabase-backup.tar.gz.gpg
tar -xzf supabase-backup.tar.gz
```

GPG จะถามรหัสเข้ารหัส แล้วจะได้ไฟล์ `roles.sql`, `schema.sql`, `data.sql` ซึ่งมีข้อมูลอ่อนไหว ต้องเก็บในที่ปลอดภัยและลบหลังทดสอบ ตั้งฐานข้อมูล Supabase **ใหม่สำหรับทดลอง** และทำตามคู่มือ Supabase เรื่อง [การสำรองและกู้คืนด้วย CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) โดยตรวจสอบคำสั่งและสิทธิ์สำหรับปลายทางก่อน อย่ารันไฟล์กู้คืนลงฐานข้อมูลจริงโดยไม่ได้เตรียมแผน เพราะอาจเกิดข้อมูลขัดแย้งหรือสูญหาย

การ dump roles, schema และ data แยกกันไม่ใช่ snapshot เดียวกัน หากมีการแก้ฐานข้อมูลระหว่างทำงาน ข้อมูลอาจไม่สอดคล้องกัน ควรสำรองช่วงร้านปิดและทดสอบกู้คืนจริง การสำรองนี้ไม่ใช่ point-in-time recovery และข้อมูลหลังการสำรองล่าสุดอาจสูญหายได้

## สิ่งที่ยังไม่รวม

- รูปอาหารและไฟล์จริงใน Supabase Storage ไม่รวมอยู่ใน database dump ต้องสำรองไฟล์แยกไปยังพื้นที่ส่วนตัวที่เข้ารหัส
- การตั้งค่าโปรเจกต์ รหัสผ่านของ custom roles และ secrets ต่าง ๆ อาจต้องจัดเก็บและตั้งค่าใหม่แยกกัน
- Workflow นี้ยังไม่มีการทดสอบกู้คืนอัตโนมัติ ไม่มีการแจ้งเตือนนอกเหนือจากสถานะและระบบแจ้งเตือนของ GitHub และยังไม่ได้เชื่อมปลายทางเก็บสำรองระยะยาว
