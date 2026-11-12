import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsInt, Min, ValidateIf } from 'class-validator';

export class UpdateComboRelationDto {
  @ApiProperty({ description: 'ID del producto normal, o null para quitar el vínculo.', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsInt()
  @Min(1)
  comboBaseProductId: number | null;
}
