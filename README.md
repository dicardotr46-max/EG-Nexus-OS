# 🚀 EG Nexus OS v5.1 — GitHub-Ready PWA & Automated Android APK Factory

این پکیج شامل نسخه کامل، یکپارچه و تست‌شده **EG Nexus OS v5.1** (تجمیع هر ۵ بخش اصلی + معماری پلاگین `window.NexusBus` + جعبه سیاه خودترمیم‌گر تلگرام `window.NexusBlackBox`) به همراه زیرساخت نصب فوری **PWA** و کارخانه خودکار ساخت **APK** روی GitHub Actions (مخصوص کار با موبایل بدون نیاز به لپ‌تاپ) است.

## 📁 ساختار فایل‌های پروژه

- `index.html`: فایل تک‌صفحه‌ای کامل و یکپارچه اجرایی (شامل تمام ۵ فاز + ماژول `NexusBus` و `NexusBlackBox`).
- `manifest.json`: فایل مانیفست استاندارد وب‌اپلیکیشن پیشرونده (PWA) برای نصب مستقیم روی صفحه اصلی گوشی.
- `sw.js`: سرویس‌ورکر استاندارد Offline-First برای اجرای سریع و بدون قطعی روی موبایل.
- `.github/workflows/nexus-factory.yml`: ورک‌فلوی خودکار گیت‌هاب اکشن شامل:
  1. تست خودکار سلامت سینتکس و AST جاوااسکریپت (`vm.Script`) با هر بار آپدیت کد.
  2. کامپایل و ساخت خودکار فایل نصبی اندروید (`app-debug.apk`) با **Capacitor 8.5.3** و قرار دادن آن در بخش **Artifacts** گیت‌هاب.
  3. پشتیبانی از اجرای خودکار با هر `push`، اجرای زمان‌بندی‌شده (`schedule` / Cron روزانه) و اجرای دستی با یک لمس از روی گوشی (`workflow_dispatch`).
- `capacitor.config.json` و `package.json`: تنظیمات آماده Capacitor 8.5.3 و اسکریپت تست سینتکس (`npm run test:syntax`).

## 📱 راهنمای استفاده سریع فقط با گوشی موبایل (بدون لپ‌تاپ)

1. در گیت‌هاب از طریق مرورگر گوشی یک مخزن (Repository) جدید بسازید و فایل‌های داخل این پکیج (`.zip`) را در ریشه مخزن آپلود کنید.
2. به تب **Actions** مخزن بروید، ورک‌فلوی **EG Nexus OS v5.1 — Syntax Audit & Android APK Factory** را انتخاب کرده و دکمه **Run workflow** را بزنید.
3. پس از اتمام تیک سبز، در پایین همان صفحه در بخش **Artifacts**، فایل **`EG-Nexus-OS-v5.1-Android-APK`** را دانلود و روی گوشی اندرویدی خود نصب کنید.
4. برای استفاده به عنوان **PWA**، از بخش **Settings > Pages** مخزن، گزینه GitHub Pages را روی شاخه `main` فعال کنید تا لینک مستقیم وب‌اپلیکیشن شما با قابلیت **Add to Home Screen** فعال شود.

## 🧩 نمونه استفاده از گذرگاه پلاگین (`window.NexusBus`)

برای افزودن قابلیت جدید بدون دست زدن به کدهای بخش ۱ تا ۵:

```javascript
window.NexusBus.registerPlugin({
  id: 'my-custom-plugin',
  name: 'پلاگین سفارشی من',
  version: '1.0.0',
  init(ctx) {
    ctx.on('custom:ping', (payload) => {
      ctx.showToast('پلاگین پیام را دریافت کرد: ' + payload.text);
    });
  }
});
```
