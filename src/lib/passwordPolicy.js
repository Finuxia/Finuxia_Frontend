export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_REQUIREMENT = `At least ${MIN_PASSWORD_LENGTH} characters.`;

export function passwordTooShort(password) {
  return password.length < MIN_PASSWORD_LENGTH;
}
