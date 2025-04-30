import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { join } from "path";
import { User } from "./user/entities/user-entity";
import { UserTenantMapping } from "./userTenantMapping/entities/user-tenant-mapping.entity";
import { Tenant } from "./tenant/entities/tenent.entity";
import { AutomaticMember } from "./automatic-member/entity/automatic-member.entity";
import { Cohort } from "./cohort/entities/cohort.entity";
import { State } from "./cohort/entities/state.entity";
import { CohortAcademicYear } from "./cohortAcademicYear/entities/cohortAcademicYear.entity";
import { CohortMembers } from "./cohortMembers/entities/cohort-member.entity";
import { FieldValues } from "./fields/entities/fields-values.entity";
import { Fields } from "./fields/entities/fields.entity";
import { Form } from "./forms/entities/form.entity";
import { Location } from "./location/entities/location.entity";
import { AcademicYear } from "./academicyears/entities/academicyears-entity";
import { RolePermission } from "./permissionRbac/rolePermissionMapping/entities/rolePermissionMapping";
import { RolePrivilegeMapping } from "./rbac/assign-privilege/entities/assign-privilege.entity";
import { UserRoleMapping } from "./rbac/assign-role/entities/assign-role.entity";
import { Privilege } from "./rbac/privilege/entities/privilege.entity";
import { Role } from "./rbac/role/entities/role.entity";

// Load .env file
dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [
    AcademicYear,
    AutomaticMember,
    Cohort,
    State,
    CohortAcademicYear,
    CohortMembers,
    FieldValues,
    Fields,
    Form,
    Location,
    RolePermission,
    RolePrivilegeMapping,
    UserRoleMapping,
    Privilege,
    Role,
    Tenant,
    User,
    UserTenantMapping,
  ],
  migrations: [join(__dirname, "migrations", "*.ts")], // dev
  synchronize: false,
  logging: true,
});
