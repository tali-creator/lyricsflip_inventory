import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationStatus } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { CreateNotificationDto, CreateBulkNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationDeliveryService } from './services/notification-delivery.service';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
    private templateService: NotificationTemplateService,
    private deliveryService: NotificationDeliveryService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createNotificationDto);
    const savedNotification = await this.notificationRepository.save(notification);
    
    // Process notification delivery
    await this.processNotificationDelivery(savedNotification);
    
    return savedNotification;
  }

  async createBulk(createBulkNotificationDto: CreateBulkNotificationDto): Promise<Notification[]> {
    const { userIds, ...notificationData } = createBulkNotificationDto;
    
    const notifications = userIds.map(userId => 
      this.notificationRepository.create({
        ...notificationData,
        userId
      })
    );
    
    const savedNotifications = await this.notificationRepository.save(notifications);
    
    // Process delivery for all notifications
    await Promise.all(
      savedNotifications.map(notification => this.processNotificationDelivery(notification))
    );
    
    return savedNotifications;
  }

  async findAll(query: QueryNotificationDto) {
    const { page, limit, ...filters } = query;
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .skip(skip)
      .take(limit)
      .orderBy('notification.createdAt', 'DESC');

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        queryBuilder.andWhere(`notification.${key} = :${key}`, { [key]: value });
      }
    });

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async findByUser(userId: string, query: QueryNotificationDto) {
    const { page, limit, ...filters } = query;
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId, ...filters },
      relations: ['user'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' }
    });

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto): Promise<Notification> {
    const notification = await this.findOne(id);
    
    Object.assign(notification, updateNotificationDto);
    return this.notificationRepository.save(notification);
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.findOne(id);
    
    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();
    
    return this.notificationRepository.save(notification);
  }

  async remove(id: string): Promise<void> {
    const result = await this.notificationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({ where: { userId } });
  }

  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreference>[]): Promise<NotificationPreference[]> {
    const existingPreferences = await this.getUserPreferences(userId);
    
    for (const pref of preferences) {
      const existing = existingPreferences.find(p => p.type === pref.type && p.category === pref.category);
      
      if (existing) {
        Object.assign(existing, pref);
        await this.preferenceRepository.save(existing);
      } else {
        const newPreference = this.preferenceRepository.create({ ...pref, userId });
        await this.preferenceRepository.save(newPreference);
      }
    }
    
    return this.getUserPreferences(userId);
  }

  private async processNotificationDelivery(notification: Notification): Promise<void> {
    try {
      // Check if scheduled for later
      if (notification.scheduledAt && notification.scheduledAt > new Date()) {
        return; // Will be processed by a scheduler/queue
      }

      // Check user preferences
      if (notification.userId) {
        const preferences = await this.getUserPreferences(notification.userId);
        const typePreference = preferences.find(p => p.type === notification.type);
        
        if (typePreference && !typePreference.enabled) {
          notification.status = NotificationStatus.FAILED;
          notification.errorMessage = 'User has disabled this notification type';
          await this.notificationRepository.save(notification);
          return;
        }
      }

      let title = notification.title;
      let message = notification.message;

      // Render template if specified
      if (notification.templateId) {
        const rendered = this.templateService.renderTemplate(
          notification.templateId,
          notification.templateData || {}
        );
        title = rendered.subject || title;
        message = rendered.body;
      }

      let deliveryResult;

      // Deliver based on type
      switch (notification.type) {
        case 'email':
          // You'll need user email - assuming it's in user relation or metadata
          const email = notification.user?.email || notification.metadata?.email;
          if (email) {
            deliveryResult = await this.deliveryService.deliverEmail(email, title, message);
          }
          break;
        case 'sms':
          // You'll need user phone - assuming it's in user relation or metadata
          const phone = notification.user?.phone || notification.metadata?.phone;
          if (phone) {
            deliveryResult = await this.deliveryService.deliverSMS(phone, message);
          }
          break;
        case 'in-app':
          deliveryResult = await this.deliveryService.deliverInApp(notification.userId, title, message);
          break;
      }

      // Update notification status
      if (deliveryResult?.success) {
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
        notification.metadata = {
          ...notification.metadata,
          messageId: deliveryResult.messageId
        };
      } else {
        notification.status = NotificationStatus.FAILED;
        notification.errorMessage = deliveryResult?.error || 'Unknown error';
        notification.retryCount += 1;
      }

      await this.notificationRepository.save(notification);
    } catch (error) {
      notification.status = NotificationStatus.FAILED;
      notification.errorMessage = error.message;
      notification.retryCount += 1;
      await this.notificationRepository.save(notification);
    }
  }
}
