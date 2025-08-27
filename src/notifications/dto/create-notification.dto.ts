import { IsString, IsEnum, IsOptional, IsUUID, IsObject, IsDateString, IsArray } from 'class-validator';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsString()
  @IsOptional()
  category?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  templateData?: Record<string, any>;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class CreateBulkNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsString()
  @IsOptional()
  category?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  templateData?: Record<string, any>;

  @IsArray()
  @IsUUID(4, { each: true })
  userIds: string[];

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
