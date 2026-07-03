import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveMqlDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comentario?: string;
}
