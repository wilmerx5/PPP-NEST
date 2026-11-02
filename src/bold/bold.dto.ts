import { IsInt, IsNumber, Max, Min } from 'class-validator';
export class ClaimBoldDto {
  @IsInt() @Min(1) orderId: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999999.99)
  advanceAmount: number;
}
