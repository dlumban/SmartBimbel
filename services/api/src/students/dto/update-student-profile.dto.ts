import { PartialType } from "@nestjs/mapped-types";
import { UpsertStudentProfileDto } from "./upsert-student-profile.dto";

export class UpdateStudentProfileDto extends PartialType(UpsertStudentProfileDto) {}
