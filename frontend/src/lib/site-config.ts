/**
 * Central site configuration — contact details, social links, and
 * cross-site URLs. Update here, applies everywhere.
 */

export const SITE = {
  name: 'VaceUp Digital Academy',
  url: 'https://vaceup.ng',
  email: 'vaceupacademy@gmail.com',
  phone: '+234 814 579 8943',
  phoneHref: 'tel:+2348145798943',
  whatsapp: 'https://wa.me/2348145798943',
  address: '669, Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos State',
  /** VaceUp Kids Tech Academy runs as an independent Cloudflare Pages site. */
  kidsUrl: process.env.NEXT_PUBLIC_KIDS_ACADEMY_URL || 'https://kids.vaceup.ng',
} as const;

/** TikTok has no Bootstrap icon — rendered as inline SVG by <SocialIcon/>. */
export const SOCIAL_LINKS = [
  { label: 'WhatsApp', href: SITE.whatsapp, icon: 'whatsapp' },
  { label: 'Facebook', href: 'https://www.facebook.com/share/1Gj9BfAk5E/', icon: 'facebook' },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/vaceupdigitalacademy',
    icon: 'instagram',
  },
  { label: 'TikTok', href: 'https://www.tiktok.com/@vaceupdigitalacademy', icon: 'tiktok' },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@vaceupdigitalacademy',
    icon: 'youtube',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/vaceup-academy/',
    icon: 'linkedin',
  },
] as const;

/** VaceUp Kids Tech Academy socials (kids brand). */
export const KIDS_SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/14mbUoVbbpF/',
    icon: 'facebook',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/vaceupkidstech',
    icon: 'instagram',
  },
  { label: 'YouTube', href: 'https://youtube.com/@vaceupkidstech', icon: 'youtube' },
] as const;
