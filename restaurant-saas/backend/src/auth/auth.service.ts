import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  getMe() {
    return { id: '1', email: 'test@example.com' };
  }

  login(dto: any) {
    return { accessToken: 'mock-token', user: dto };
  }

  logout() {
    return { success: true };
  }
}
