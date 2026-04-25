import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { DocumentModule } from './document/document.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [AuthModule, WorkspaceModule, DocumentModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
