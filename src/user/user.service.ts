import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(createDto: CreateUserDto): Promise<UserResponseDto> {
    const exists = await this.userRepo.findOne({
      where: { email: createDto.email },
    });
    if (exists) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createDto.password, 10);

    const newUser = this.userRepo.create({
      name: createDto.name,
      email: createDto.email,
      password_hash: hashedPassword,
    });

    const savedUser = await this.userRepo.save(newUser);

    return this.toResponse(savedUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  private toResponse(user: User): UserResponseDto {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}
