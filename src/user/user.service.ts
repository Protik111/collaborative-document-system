import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async testConnection(): Promise<string> {
    try {
      await this.userRepo.query('SELECT 1');
      return 'Database connection successful';
    } catch (error) {
      console.error('Database connection error:', error);
      throw new Error('Database connection failed');
    }
  }
}
