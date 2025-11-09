import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const userId = req.header('x-user-id');

    if (!userId) {
      throw new UnauthorizedException('x-user-id header is required');
    }

    req.user = { id: userId };
    return true;
  }
}
