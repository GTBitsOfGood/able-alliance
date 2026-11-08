-- Block deletion of an accommodation that is still assigned to a student.
-- Removing a student still cascades and drops that student's link.
-- DropForeignKey
ALTER TABLE "_AccommodationToStudentProfile" DROP CONSTRAINT "_AccommodationToStudentProfile_A_fkey";

-- AddForeignKey
ALTER TABLE "_AccommodationToStudentProfile" ADD CONSTRAINT "_AccommodationToStudentProfile_A_fkey" FOREIGN KEY ("A") REFERENCES "Accommodation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
