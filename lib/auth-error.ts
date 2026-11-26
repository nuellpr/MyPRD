/** Error autentikasi dengan status HTTP. Dipisah supaya modul murni (OTP, dll.) bisa memakainya tanpa Next.js. */
export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
