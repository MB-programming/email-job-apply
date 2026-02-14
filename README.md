# MailBot — AI Job Apply Automation

تطبيق Desktop لأتمتة البحث عن وظائف وإرسال طلبات التوظيف بالبريد الإلكتروني، مدعوم بـ GPT-4o.

---

## المتطلبات

- **Node.js** نسخة 18 أو أحدث → https://nodejs.org
- **Git** (اختياري)

---

## تشغيل التطبيق (للتجربة)

```bash
# 1. تثبيت الـ packages
npm install

# 2. تشغيل التطبيق مباشرة
npm start
```

---

## بناء تطبيق Desktop

### على Mac (ينتج DMG)

```bash
npm install
npm run build:mac
```

الملف هيكون في: `dist/MailBot-1.0.0.dmg`

---

### على Windows (ينتج EXE Installer)

```bash
npm install
npm run build:win
```

الملف هيكون في: `dist/MailBot Setup 1.0.0.exe`

---

### بناء الاثنين معاً (من Mac فقط)

```bash
npm install
npm run build:all
```

---

## الإعداد الأول

1. افتح التطبيق وروح على **Settings**
2. في **Email Account**: اختر Gmail / Outlook / Yahoo أو أدخل إعدادات IMAP/SMTP يدوياً
3. في **OpenAI API**: أضف الـ API key بتاعك من [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
4. في **Your Profile**: أضف اسمك، skills، ومسار الـ CV

---

## الميزات

| الميزة | الوصف |
|--------|-------|
| AI Chat | شات مع GPT-4o لإيجاد شركات وكتابة ايميلات بالألماني |
| Inbox | عرض الرسايل الواردة |
| Sent | عرض الايميلات المرسلة |
| Compose | كتابة وإرسال ايميلات مع توليد AI بالألماني |
| Settings | إعداد الايميل + OpenAI key + البروفايل |
