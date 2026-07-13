import { describe,expect,it } from 'vitest';
import { authErrorMessage } from './user-message';
describe('authErrorMessage',()=>{it('traduz credenciais inválidas',()=>expect(authErrorMessage('Invalid login credentials','login')).toBe('E-mail ou senha incorretos.'));it('não expõe erro desconhecido',()=>expect(authErrorMessage('internal database detail','signup')).toBe('Não foi possível criar sua conta. Tente novamente.'));});
