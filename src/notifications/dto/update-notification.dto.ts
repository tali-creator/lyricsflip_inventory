import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from './create-notification.dto';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}

// src/notifications/dto/query-notification.dto.ts
import { IsOptional, IsEnum, IsUUID, IsString, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationType, NotificationPriority, NotificationStatus } from '../entities/notification.entity';

export class QueryNotificationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}