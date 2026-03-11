export type Grade = 'Definitely Not' | 'No' | 'Yes' | 'Strong Yes'

export interface UserGrade {
  user_name: string
  grade: Grade
}

export interface Candidate {
  id: string
  name: string
  role: string
  recruiter_name: string
  greenhouse_link: string
  grades: UserGrade[]
  submitted_at: string
  week_of: string
}
