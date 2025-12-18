// src/modules/proveedores/dto/set-proveedor-materias-primas.dto.ts
import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class SetProveedorMateriasPrimasDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  materiaPrimaIds: string[];
}
