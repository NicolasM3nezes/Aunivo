export function authErrorMessage(message: string, operation: 'login' | 'signup' | 'recovery'): string {
  const value = message.toLowerCase();
  if (value.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (value.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (value.includes('user already registered') || value.includes('already been registered')) return 'Este e-mail já está cadastrado.';
  if (value.includes('password') && value.includes('6')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (value.includes('rate limit') || value.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (operation === 'login') return 'Não foi possível entrar. Verifique seus dados e tente novamente.';
  if (operation === 'signup') return 'Não foi possível criar sua conta. Tente novamente.';
  return 'Não foi possível enviar o link de recuperação. Tente novamente.';
}
