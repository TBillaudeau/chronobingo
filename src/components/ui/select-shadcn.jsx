import * as React from "react"
import {
  Select as SelectPrimitive,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive ref={ref} {...props}>
    {children}
  </SelectPrimitive>
))
Select.displayName = SelectPrimitive.displayName

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton ref={ref} className={className} {...props} />
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton ref={ref} className={className} {...props} />
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
