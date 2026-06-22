import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'URL pública de la imagen de la categoría (landing, menú)',
    example: 'https://cms.prontopolloportal.com/wp-content/uploads/2022/01/pollo.jpg',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}
