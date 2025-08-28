export interface NotificationTemplate {
    id: string;
    name: string;
    type: NotificationType;
    subject?: string;
    body: string;
    variables: string[];
  }
  
  export interface NotificationDeliveryResult {
    success: boolean;
    messageId?: string;
    error?: string;
  }
  