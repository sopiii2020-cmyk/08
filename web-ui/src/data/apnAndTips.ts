export interface ApnField {
  label: string;
  value: string;
}

export interface OperatorApnProfile {
  id: 'mci' | 'irancell' | 'rightel' | 'shatel';
  name: string;
  subtitle: string;
  fields: ApnField[];
  stabilityTip: string;
}

export interface OptimizationItem {
  id: string;
  category: 'gps' | 'apn' | 'system';
  categoryLabel: string;
  title: string;
  detail: string;
  androidPath: string;
}

export const OPERATOR_APN_PROFILES: OperatorApnProfile[] = [
  {
    id: 'mci',
    name: 'همراه اول (MCI)',
    subtitle: 'کد اپراتور 432-11',
    fields: [
      { label: 'Name', value: 'MCI-Internet' },
      { label: 'APN', value: 'mcinet' },
      { label: 'MCC', value: '432' },
      { label: 'MNC', value: '11' },
      { label: 'Authentication type', value: 'Not set (یا PAP)' },
      { label: 'APN type', value: 'default,supl' },
      { label: 'APN protocol', value: 'IPv4/IPv6' },
    ],
    stabilityTip: 'در مناطق شلوغ یا جاده‌ای که آنتن بین 4G و 3G مدام جابه‌جا می‌شود و اینترنت قطع می‌گردد، شبکه را موقتاً روی 4G/3G یا فقط 3G تست کنید و از ثبت بودن supl در APN type مطمئن شوید (برای کمک به قفل سریع‌تر A-GPS).',
  },
  {
    id: 'irancell',
    name: 'ایرانسل (MTN Irancell)',
    subtitle: 'کد اپراتور 432-35',
    fields: [
      { label: 'Name', value: 'Irancell-Internet' },
      { label: 'APN', value: 'mtnirancell' },
      { label: 'MCC', value: '432' },
      { label: 'MNC', value: '35' },
      { label: 'Authentication type', value: 'Not set' },
      { label: 'APN type', value: 'default,supl' },
      { label: 'APN protocol', value: 'IPv4/IPv6' },
    ],
    stabilityTip: 'در صورت داشتن افت پینگ روی IPv6 یا اختلال دریافت درخواست، یک APN جدید با پروتکل فقط IPv4 بسازید و روی همان ذخیره و انتخاب کنید.',
  },
  {
    id: 'rightel',
    name: 'رایتل (RighTel)',
    subtitle: 'کد اپراتور 432-20',
    fields: [
      { label: 'Name', value: 'RighTel-Internet' },
      { label: 'APN', value: 'RighTel' },
      { label: 'MCC', value: '432' },
      { label: 'MNC', value: '20' },
      { label: 'Authentication type', value: 'Not set' },
      { label: 'APN type', value: 'default,supl' },
      { label: 'APN protocol', value: 'IPv4' },
    ],
    stabilityTip: 'در مناطق فاقد پوشش مستقیم رایتل، فعال بودن رومینگ ملی (Data Roaming) در تنظیمات سیم‌کارت برای حفظ اتصال بین دکل‌ها ضروری است.',
  },
  {
    id: 'shatel',
    name: 'شاتل موبایل (Shatel Mobile)',
    subtitle: 'کد اپراتور 432-08',
    fields: [
      { label: 'Name', value: 'ShatelMobile' },
      { label: 'APN', value: 'shatelmobile' },
      { label: 'MCC', value: '432' },
      { label: 'MNC', value: '08' },
      { label: 'Authentication type', value: 'Not set' },
      { label: 'APN type', value: 'default,supl' },
      { label: 'APN protocol', value: 'IPv4/IPv6' },
    ],
    stabilityTip: 'به دلیل استفاده شاتل موبایل از شبکه هوشمند رومینگ بین دکل‌ها، گزینه Data Roaming سیم‌کارت را روشن بگذارید تا هنگام جابه‌جایی شهری اتصال قطع نشود.',
  },
];

export const OPTIMIZATION_CHECKLIST: OptimizationItem[] = [
  {
    id: 'gps-high-accuracy',
    category: 'gps',
    categoryLabel: 'GPS و موقعیت',
    title: 'فعال‌سازی دقت بالای موقعیت‌یابی (Google Location Accuracy)',
    detail: 'در اندروید روشن بودن اسکن وای‌فای و بلوتوث در پس‌زمینه (حتی وقتی وای‌فای خاموش است) سرعت قفل اولیه GPS در معابر شهری و بین ساختمان‌های بلند را چند برابر می‌کند.',
    androidPath: 'Settings > Location > Location services > Google Location Accuracy + Wi-Fi/Bluetooth scanning',
  },
  {
    id: 'gps-precise-permission',
    category: 'gps',
    categoryLabel: 'GPS و موقعیت',
    title: 'تأیید دسترسی موقعیت دقیق (Precise) و همیشگی برای اپلیکیشن راننده',
    detail: 'در اندروید ۱۲ به بالا اگر دسترسی روی Approximate یا Only while using باشد، با رفتن برنامه به پس‌زمینه موقعیت فریز می‌شود. حتماً گزینه Allow all the time و Use precise location را فعال کنید.',
    androidPath: 'Settings > Apps > Snapp Driver > Permissions > Location > Allow all the time + Precise',
  },
  {
    id: 'apn-supl-agps',
    category: 'apn',
    categoryLabel: 'آنتن و APN',
    title: 'بررسی وجود supl در فیلد APN type و ریست APN',
    detail: 'پروتکل SUPL داده‌های کمکی A-GPS را از طریق اینترنت سیم‌کارت دریافت می‌کند تا GPS سریع‌تر ماهواره‌ها را پیدا کند. همچنین پاک کردن Proxy و Port اضافی در APN مانع افت ناگهانی اتصال می‌شود.',
    androidPath: 'Settings > Connections / Mobile networks > Access Point Names (APN)',
  },
  {
    id: 'apn-network-mode',
    category: 'apn',
    categoryLabel: 'آنتن و APN',
    title: 'جلوگیری از سوییچ مدام 4G/5G در نقاط ضعیف',
    detail: 'وقتی گوشی مدام بین 5G و 4G یا 4G و 3G جابه‌جا می‌شود، هر بار اتصال دیتا چند ثانیه قطع می‌گردد. در گوشی‌های 5G اگر در مسیر پوشش پایدار نیست، حالت LTE/3G (4G) پایداری بسیار بیشتری دارد.',
    androidPath: 'Settings > Mobile network > Preferred network type > LTE/3G/2G (یا تست LTE only در نقاط با پوشش خوب)',
  },
  {
    id: 'apn-private-dns',
    category: 'apn',
    categoryLabel: 'آنتن و APN',
    title: 'بررسی DNS خصوصی (Private DNS) و قطع فیلترشکن حین کار',
    detail: 'وجود فیلترشکن فعال یا DNS خصوصی کند روی گوشی باعث افزایش شدید پینگ، تاخیر در دریافت درخواست سفر و خطای اتصال به سرورهای داخلی می‌شود.',
    androidPath: 'Settings > Network & internet > Private DNS > Automatic یا Off',
  },
  {
    id: 'sys-battery-unrestricted',
    category: 'system',
    categoryLabel: 'باتری و سیستم',
    title: 'قرار دادن اپلیکیشن راننده روی Unrestricted در بهینه‌سازی باتری',
    detail: 'حالت Optimized یا Restricted در گوشی‌های شیائومی، سامسونگ و هواوی پس از قفل شدن صفحه، سرویس GPS و دریافت درخواست در پس‌زمینه را متوقف می‌کند.',
    androidPath: 'Settings > Apps > Snapp Driver > Battery > Unrestricted (بدون محدودیت)',
  },
  {
    id: 'sys-background-data',
    category: 'system',
    categoryLabel: 'باتری و سیستم',
    title: 'آزادسازی دیتای پس‌زمینه و خاموش کردن Data Saver',
    detail: 'روشن بودن صرفه‌جویی دیتا (Data Saver) باعث قطع دسترسی شبکه اپلیکیشن هنگام کار با برنامه‌های دیگر مثل مسیریاب می‌شود.',
    androidPath: 'Settings > Apps > Snapp Driver > Mobile data & Wi-Fi > Background data + Unrestricted data usage',
  },
  {
    id: 'sys-windshield-mount',
    category: 'system',
    categoryLabel: 'باتری و سیستم',
    title: 'نصب گوشی در محل مناسب روی داشبورد و استفاده از شارژر استاندارد',
    detail: 'قرار دادن گوشی در کنسول پایین، محفظه فلزی یا در معرض داغی شدید پردازنده باعث افت دریافت سیگنال ماهواره‌ها و افت عملکرد مودم می‌شود.',
    androidPath: 'نصب هولدر نزدیک شیشه جلو و پرهیز از کاورهای آهنربایی ضخیم',
  },
];
