import { ConflictException, Injectable } from '@nestjs/common';
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
      throw new ConflictException('Email already exists');
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

  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'password_hash',
        'name',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
    });
  }

  async findByEmailPublic(
    email: string,
  ): Promise<Omit<User, 'password_hash'> | null> {
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'created_at', 'updated_at'], // Exclude password_hash
    });
  }

  private toResponse(user: User): UserResponseDto {
    const { password_hash, deleted_at, ...safeUser } = user;
    return safeUser;
  }
}
