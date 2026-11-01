import { createContext, useContext } from 'react'
import { GEAR_WRITER, type GearWriter } from './buildStore'

/** Whose gear the paper doll, slot editor and pickers change: yours, or the build's in edit mode (`PLAN_WRITER`). */
export const GearWriterContext = createContext<GearWriter>(GEAR_WRITER)

export const useGearWriter = () => useContext(GearWriterContext)
