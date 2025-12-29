const CREATE_PAYMENT_URL =
  'https://ngenius-backend-251188713496.europe-west1.run.app/create-payment';

export const createPayment = async (
  amount: number,
  orderId: string
) => {
  const res = await fetch(CREATE_PAYMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      orderId, // ✅ requis par le backend
    }),
  });

  // 🔥 lecture brute AVANT json (évite le crash HTML)
  const text = await res.text();
  console.log('BACKEND RESPONSE RAW:', text);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Backend a retourné du HTML au lieu de JSON');
  }

  if (!res.ok) {
    throw new Error(data?.error || 'Payment creation failed');
  }

  if (!data.paymentUrl) {
    throw new Error('paymentUrl manquant');
  }

  return data;
};
