import { Injectable } from '@nestjs/common';
import { NotificationTemplate } from '../interfaces/notification-template.interface';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class NotificationTemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'welcome-email',
        name: 'Welcome Email',
        type: NotificationType.EMAIL,
        subject: 'Welcome to {{appName}}!',
        body: 'Hi {{userName}}, welcome to our platform!',
        variables: ['appName', 'userName']
      },
      {
        id: 'system-alert',
        name: 'System Alert',
        type: NotificationType.IN_APP,
        body: 'System Alert: {{message}}',
        variables: ['message']
      },
      {
        id: 'sms-verification',
        name: 'SMS Verification',
        type: NotificationType.SMS,
        body: 'Your verification code is: {{code}}',
        variables: ['code']
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  renderTemplate(templateId: string, data: Record<string, any>): { subject?: string; body: string } {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    let body = template.body;
    let subject = template.subject;

    // Replace variables with actual data
    template.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      const value = data[variable] || '';
      body = body.replace(regex, value);
      if (subject) {
        subject = subject.replace(regex, value);
      }
    });

    return { subject, body };
  }

  addTemplate(template: NotificationTemplate) {
    this.templates.set(template.id, template);
  }
}
