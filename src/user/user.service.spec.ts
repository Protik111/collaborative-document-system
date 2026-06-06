import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let repo: Repository<User>;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    name: 'Test User',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = { name: 'Test User', email: 'test@example.com', password: 'password' };

    it('should successfully create a new user', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        created_at: mockUser.created_at,
        updated_at: mockUser.updated_at,
      });
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: createDto.email } });
      expect(bcrypt.hash).toHaveBeenCalledWith(createDto.password, 10);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findByEmailForAuth', () => {
    it('should return user with password_hash for auth', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmailForAuth('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { email: 'test@example.com' },
        select: expect.arrayContaining(['password_hash']),
      }));
    });
  });

  describe('findById', () => {
    it('should return user without password_hash', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-id');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-id' },
        select: expect.not.arrayContaining(['password_hash']),
      }));
    });
  });
});
