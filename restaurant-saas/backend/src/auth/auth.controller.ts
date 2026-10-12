import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  getMe() {
    return { message: 'Current user' };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  login(@Body() body: any) {
    return { message: 'Login endpoint', body };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout' })
  logout() {
    return { message: 'Logout successful' };
  }
}
