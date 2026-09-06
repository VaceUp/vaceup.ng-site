/**
 * Central site configuration — contact details, social links, and
 * cross-site URLs. Update here, applies everywhere.
 */

export const SITE = {
  name: 'VaceUp Digital Academy',
  url: 'https://vaceup.ng',
  email: 'info@vaceup.ng',
  phone: '+234 814 579 8943',
  phoneHref: 'tel:+2348145798943',
  whatsapp: 'https://wa.me/2348145798943',
  address: '669, Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos State',
  /**
   * VaceUp Kids Tech Academy is a separate site on its own subdomain.
   * Until kids.vaceup.ng ships, this points at the interim landing page
   * in this repo — flip it to 'https://kids.vaceup.ng' in one line.
   */
  kidsUrl: '/kids-academy',
} as const;

/**
 * Social profiles. WhatsApp is verified; the other handles are our best
 * candidates — verify and update handles as the accounts are confirmed.
 */
export const SOCIAL_LINKS = [
  { label: 'WhatsApp', href: SITE.whatsapp, icon: 'whatsapp' },
  { label: 'Facebook', href: 'https://www.facebook.com/vaceup', icon: 'facebook' },
  { label: 'Instagram', href: 'https://www.instagram.com/vaceup', icon: 'instagram' },
  { label: 'X (Twitter)', href: 'https://x.com/vaceup', icon: 'twitter-x' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/vaceup', icon: 'linkedin' },
  { label: 'YouTube', href: 'https://www.youtube.com/@vaceup', icon: 'youtube' },
] as const;
