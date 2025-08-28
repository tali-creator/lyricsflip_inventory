// notification.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../user/user.entity'; // Adjust path as needed

export enum NotificationType {
  EMAIL = 'email',
  IN_APP = 'in-app',
  SMS = 'sms',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['type', 'status'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.IN_APP,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  templateId: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// user-notification-preference.entity.ts
@Entity('user_notification_preferences')
export class UserNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'boolean', default: true })
  emailEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  inAppEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  smsEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// notification-template.entity.ts
@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  templateId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  emailTemplate: string;

  @Column({ type: 'text' })
  inAppTemplate: string;

  @Column({ type: 'text', nullable: true })
  smsTemplate: string;

  @Column({ type: 'json', nullable: true })
  variables: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// dto/create-notification.dto.ts
import { IsString, IsEnum, IsUUID, IsOptional, IsObject, IsDateString } from 'class-validator';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.IN_APP;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: Date;
}

export class BulkNotificationDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.IN_APP;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsUUID('4', { each: true })
  userIds: string[];

  @IsString()
  @IsOptional()
  category?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  templateId?: string;
}

// notification.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Notification,
  NotificationType,
  DeliveryStatus,
} from './entities/notification.entity';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { CreateNotificationDto, BulkNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(UserNotificationPreference)
    private preferenceRepository: Repository<UserNotificationPreference>,
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
  ) {}

  async create(createDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createDto);
    const saved = await this.notificationRepository.save(notification);
    
    // Process notification delivery
    await this.processNotificationDelivery(saved);
    
    return saved;
  }

  async createBulk(bulkDto: BulkNotificationDto): Promise<Notification[]> {
    const notifications = bulkDto.userIds.map(userId => 
      this.notificationRepository.create({
        ...bulkDto,
        userId,
        userIds: undefined,
      })
    );

    const saved = await this.notificationRepository.save(notifications);
    
    // Process bulk delivery
    await Promise.all(
      saved.map(notification => this.processNotificationDelivery(notification))
    );

    return saved;
  }

  async findAll(
    page = 1,
    limit = 10,
    userId?: string,
    category?: string,
    type?: NotificationType,
    status?: DeliveryStatus,
  ) {
    const query = this.notificationRepository.createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .orderBy('notification.createdAt', 'DESC');

    if (userId) {
      query.andWhere('notification.userId = :userId', { userId });
    }

    if (category) {
      query.andWhere('notification.category = :category', { category });
    }

    if (type) {
      query.andWhere('notification.type = :type', { type });
    }

    if (status) {
      query.andWhere('notification.status = :status', { status });
    }

    const [notifications, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async findUserNotifications(userId: string, page = 1, limit = 10) {
    return this.findAll(page, limit, userId);
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.findOne(id);
    
    notification.status = DeliveryStatus.READ;
    notification.readAt = new Date();

    return this.notificationRepository.save(notification);
  }

  async getUserPreferences(userId: string): Promise<UserNotificationPreference[]> {
    return this.preferenceRepository.find({ where: { userId } });
  }

  async updateUserPreference(
    userId: string,
    category: string,
    preferences: Partial<UserNotificationPreference>
  ): Promise<UserNotificationPreference> {
    let preference = await this.preferenceRepository.findOne({
      where: { userId, category },
    });

    if (!preference) {
      preference = this.preferenceRepository.create({
        userId,
        category,
        ...preferences,
      });
    } else {
      Object.assign(preference, preferences);
    }

    return this.preferenceRepository.save(preference);
  }

  private async processNotificationDelivery(notification: Notification): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      const categoryPreference = preferences.find(p => p.category === notification.category);

      // Get template if specified
      let template: NotificationTemplate | null = null;
      if (notification.templateId) {
        template = await this.templateRepository.findOne({
          where: { templateId: notification.templateId },
        });
      }

      // Process based on notification type and user preferences
      switch (notification.type) {
        case NotificationType.EMAIL:
          if (!categoryPreference || categoryPreference.emailEnabled) {
            await this.sendEmail(notification, template);
          }
          break;
        case NotificationType.SMS:
          if (!categoryPreference || categoryPreference.smsEnabled) {
            await this.sendSMS(notification, template);
          }
          break;
        case NotificationType.IN_APP:
          if (!categoryPreference || categoryPreference.inAppEnabled) {
            await this.sendInApp(notification);
          }
          break;
      }

      // Update status
      notification.status = DeliveryStatus.SENT;
      notification.sentAt = new Date();
      await this.notificationRepository.save(notification);

    } catch (error) {
      this.logger.error(`Failed to process notification ${notification.id}:`, error);
      notification.status = DeliveryStatus.FAILED;
      notification.errorMessage = error.message;
      notification.retryCount += 1;
      await this.notificationRepository.save(notification);
    }
  }

  private async sendEmail(notification: Notification, template?: NotificationTemplate): Promise<void> {
    // Implement email sending logic here
    // This could integrate with services like SendGrid, AWS SES, etc.
    this.logger.log(`Sending email notification: ${notification.title}`);
    
    const content = template ? this.processTemplate(template.emailTemplate, notification.metadata) : notification.content;
    
    // Mock email sending - replace with actual implementation
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendSMS(notification: Notification, template?: NotificationTemplate): Promise<void> {
    // Implement SMS sending logic here
    // This could integrate with services like Twilio, AWS SNS, etc.
    this.logger.log(`Sending SMS notification: ${notification.title}`);
    
    const content = template ? this.processTemplate(template.smsTemplate, notification.metadata) : notification.content;
    
    // Mock SMS sending - replace with actual implementation
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendInApp(notification: Notification): Promise<void> {
    // In-app notifications are typically just stored in the database
    // and displayed in the UI. Additional logic could include WebSocket
    // broadcasting for real-time updates
    this.logger.log(`Processing in-app notification: ${notification.title}`);
  }

  private processTemplate(template: string, variables: Record<string, any> = {}): string {
    let processed = template;
    
    // Simple template variable replacement
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processed = processed.replace(regex, String(value));
    });
    
    return processed;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledNotifications(): Promise<void> {
    const scheduledNotifications = await this.notificationRepository.find({
      where: {
        status: DeliveryStatus.PENDING,
        scheduledAt: { $lte: new Date() } as any,
      },
    });

    for (const notification of scheduledNotifications) {
      await this.processNotificationDelivery(notification);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedNotifications(): Promise<void> {
    const failedNotifications = await this.notificationRepository.find({
      where: {
        status: DeliveryStatus.FAILED,
        retryCount: { $lt: 3 } as any,
      },
    });

    for (const notification of failedNotifications) {
      await this.processNotificationDelivery(notification);
    }
  }
}

// notification.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, BulkNotificationDto } from './dto/create-notification.dto';
import { NotificationType, DeliveryStatus } from './entities/notification.entity';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  @ApiQuery({ name: 'status', required: false, enum: DeliveryStatus })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('userId') userId?: string,
    @Query('category') category?: string,
    @Query('type') type?: NotificationType,
    @Query('status') status?: DeliveryStatus,
  ) {
    return this.notificationService.findAll(page, limit, userId, category, type, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification found' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully' })
  async create(@Body() createDto: CreateNotificationDto) {
    return this.notificationService.create(createDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create bulk notifications' })
  @ApiResponse({ status: 201, description: 'Bulk notifications created successfully' })
  async createBulk(@Body() bulkDto: BulkNotificationDto) {
    return this.notificationService.createBulk(bulkDto);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationService.markAsRead(id);
  }

  @Get('users/:id/notifications')
  @ApiOperation({ summary: 'Get notifications for specific user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserNotifications(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.notificationService.findUserNotifications(userId, page, limit);
  }
}

// notification.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { Notification } from './entities/notification.entity';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      UserNotificationPreference,
      NotificationTemplate,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

// Example usage in your main app.module.ts:
/*
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // your database configuration
    }),
    NotificationModule,
  ],
})
export class AppModule {}
*/