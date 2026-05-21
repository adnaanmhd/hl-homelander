/** URL-encode values for quest API query params (community replaceEncodedValue). */
export function encodeQuestValue(value: string): string {
  return encodeURIComponent(value);
}

export function formatPhoneForQuestApi(phone: string | undefined): string {
  if (!phone) return '';
  return phone.replace('+', '%2B');
}
