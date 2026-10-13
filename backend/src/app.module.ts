import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { dataSourceOptions } from './database/data-source';
import { ComparisonsModule } from './modules/comparisons/comparisons.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: false,
    }),
    ComparisonsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}