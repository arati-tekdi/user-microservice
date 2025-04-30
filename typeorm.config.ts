import { ConfigService } from "@nestjs/config";

import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { join } from "path";
import { User } from "./src/user/entities/user-entity";
import { UserTenantMapping } from "./src/userTenantMapping/entities/user-tenant-mapping.entity";
import { RolePermission } from "./src/permissionRbac/rolePermissionMapping/entities/rolePermissionMapping";
import { AcademicYear } from "./src/academicyears/entities/academicyears-entity";
import { AutomaticMember } from "./src/automatic-member/entity/automatic-member.entity";
import { Cohort } from "./src/cohort/entities/cohort.entity";
import { State } from "./src/cohort/entities/state.entity";
import { CohortAcademicYear } from "./src/cohortAcademicYear/entities/cohortAcademicYear.entity";
import { CohortMembers } from "./src/cohortMembers/entities/cohort-member.entity";
import { FieldValues } from "./src/fields/entities/fields-values.entity";
import { Fields } from "./src/fields/entities/fields.entity";
import { Form } from "./src/forms/entities/form.entity";
import { RolePrivilegeMapping } from "./src/rbac/assign-privilege/entities/assign-privilege.entity";
import { UserRoleMapping } from "./src/rbac/assign-role/entities/assign-role.entity";
import { Privilege } from "./src/rbac/privilege/entities/privilege.entity";
import { Role } from "./src/rbac/role/entities/role.entity";
import { Tenant } from "./src/tenant/entities/tenent.entity";
dotenv.config();
const configService = new ConfigService();

export default new DataSource({
  type: "postgres",
  host: configService.get("POSTGRES_HOST"),
  port: configService.get("POSTGRES_PORT"),
  database: configService.get("POSTGRES_DATABASE"),
  username: configService.get("POSTGRES_USERNAME"),
  password: configService.get("POSTGRES_PASSWORD"),
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
  migrations: [join(__dirname, "migrations", "*.ts")], // Note: .ts for development
  synchronize: false,
});
