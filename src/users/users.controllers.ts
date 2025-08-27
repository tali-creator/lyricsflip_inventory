@Controller('users')
  export class UsersController {
    constructor(private readonly notificationService: NotificationService) {}
  
    @Get(':id/notifications')
    getUserNotifications(
      @Param('id', ParseUUIDPipe) userId: string,
      @Query() query: QueryNotificationDto
    ) {
      return this.notificationService.findByUser(userId, query);
    }
  
    @Get(':id/notification-preferences')
    getUserNotificationPreferences(@Param('id', ParseUUIDPipe) userId: string) {
      return this.notificationService.getUserPreferences(userId);
    }
  
    @Put(':id/notification-preferences')
    updateUserNotificationPreferences(
      @Param('id', ParseUUIDPipe) userId: string,
      @Body() preferences: any[]
    ) {
      return this.notificationService.updateUserPreferences(userId, preferences);
    }
  }
