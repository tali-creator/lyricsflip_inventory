import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    Put,
    ParseUUIDPipe
  } from '@nestjs/common';
  import { NotificationService } from './notification.service';
  import { CreateNotificationDto, CreateBulkNotificationDto } from './dto/create-notification.dto';
  import { UpdateNotificationDto } from './dto/update-notification.dto';
  import { QueryNotificationDto } from './dto/query-notification.dto';
  
  @Controller('notifications')
  export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}
  
    @Post()
    create(@Body() createNotificationDto: CreateNotificationDto) {
      return this.notificationService.create(createNotificationDto);
    }
  
    @Post('bulk')
    createBulk(@Body() createBulkNotificationDto: CreateBulkNotificationDto) {
      return this.notificationService.createBulk(createBulkNotificationDto);
    }
  
    @Get()
    findAll(@Query() query: QueryNotificationDto) {
      return this.notificationService.findAll(query);
    }
  
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.notificationService.findOne(id);
    }
  
    @Put(':id/read')
    markAsRead(@Param('id', ParseUUIDPipe) id: string) {
      return this.notificationService.markAsRead(id);
    }
  
    @Patch(':id')
    update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updateNotificationDto: UpdateNotificationDto,
    ) {
      return this.notificationService.update(id, updateNotificationDto);
    }
  
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
      return this.notificationService.remove(id);
    }
  }
  