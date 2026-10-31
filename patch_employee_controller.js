const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'BACKEND-HRMS-main', 'src', 'controllers', 'employee.controller.ts')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Replace list method
const targetListRegex = /async list\(req: AuthRequest, res: Response\) \{[\s\S]*?return sendSuccess\(res, employees\)[\s\S]*?\} catch \(error: any\) \{[\s\S]*?return sendError\(res, error\.message \|\| 'Failed to list employee directory', 500\)[\s\S]*?\}\s*\},/

const newListMethod = `async list(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    try {
      const whereClause: any = { tenantId }

      // Support optional query filters and pagination if specified
      const { search, status, departmentId, limit, take, skip, page } = req.query as Record<string, string | undefined>

      if (status && status !== 'ALL') {
        whereClause.status = status
      }

      if (departmentId && departmentId !== 'ALL') {
        whereClause.departmentId = departmentId
      }

      if (search && search.trim()) {
        const query = search.trim()
        whereClause.OR = [
          { employeeCode: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { personalEmail: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ]
      }

      const takeNum = limit ? parseInt(limit, 10) : (take ? parseInt(take, 10) : undefined)
      const skipNum = skip ? parseInt(skip, 10) : (page && takeNum ? (parseInt(page, 10) - 1) * takeNum : undefined)

      const employees = await prisma.employee.findMany({
        where: whereClause,
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
          personalEmail: true,
          phone: true,
          gender: true,
          joiningDate: true,
          salaryGross: true,
          status: true,
          createdAt: true,
          department: {
            select: { id: true, name: true }
          },
          designation: {
            select: { id: true, title: true }
          },
          manager: {
            select: { id: true, firstName: true, lastName: true },
          },
          hrUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(takeNum ? { take: takeNum } : {}),
        ...(skipNum ? { skip: skipNum } : {}),
      })

      return sendSuccess(res, employees)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to list employee directory', 500)
    }
  },`

if (!targetListRegex.test(content)) {
  console.error('Target list method not matched!')
  process.exit(1)
}

content = content.replace(targetListRegex, newListMethod)
fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated employee.controller.ts list method!')

