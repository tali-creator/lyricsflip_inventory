import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { UserModule } from "./user/user.module";
import { CompanyModule } from "./company/company.module";
import { CompanyIsolationMiddleware } from "./company/middleware/company-isolation.middleware";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { ValidationPipe } from "./validation/validation.pipe";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST"),
        port: configService.get("DB_PORT"),
        username: configService.get("DB_USERNAME"),
        password: configService.get("DB_PASSWORD"),
        database: configService.get("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: configService.get("NODE_ENV") === "development",
      }),
      inject: [ConfigService],
    }),
    UserModule,
    CompanyModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CompanyIsolationMiddleware).forRoutes("*");
  }
}
