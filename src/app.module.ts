import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';
import { UserModule } from './user/user.module';
import { HealthController } from './health.controller';
import { WorkspaceModule } from './workspace/workspace.module';
import { WorkspaceMemberModule } from './workspace-member/workspace-member.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => getDatabaseConfig(config),
      inject: [ConfigService],
    }),
    AuthModule,
    WorkspaceModule,
    DocumentModule,
    UserModule,
    WorkspaceMemberModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
