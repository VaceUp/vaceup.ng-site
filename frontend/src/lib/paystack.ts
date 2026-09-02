export const loadPaystackScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).PaystackPop) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const initializePayment = async ({
  email,
  amountInNgn,
  onSuccess,
  onClose,
}: {
  email: string;
  amountInNgn: number;
  onSuccess: (reference: string) => void;
  onClose?: () => void;
}) => {
  const isLoaded = await loadPaystackScript();
  if (!isLoaded) {
    alert('Failed to load Paystack payment gateway. Please check your network connection.');
    return;
  }

  const handler = (window as any).PaystackPop.setup({
    key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_sample_key_12345',
    email,
    amount: amountInNgn * 100, // Convert NGN to Kobo
    currency: 'NGN',
    callback: (response: { reference: string }) => {
      onSuccess(response.reference);
    },
    onClose: () => {
      if (onClose) onClose();
    },
  });

  handler.openIframe();
};