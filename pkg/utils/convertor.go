package utils

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func ToPgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func FromPgUUID(u pgtype.UUID) uuid.UUID {
	if !u.Valid {
		return uuid.Nil
	}
	return uuid.UUID(u.Bytes)
}

func ToPgText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: s, Valid: true}
}

func FromPgText(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}

func FromPgInt32(i pgtype.Int4) int32 {
	if !i.Valid {
		return 0
	}
	return i.Int32
}

func FromPgBool(b pgtype.Bool) bool {
	if !b.Valid {
		return false
	}
	return b.Bool
}

func FromPgTimestamptz(ts pgtype.Timestamptz) time.Time {
	if !ts.Valid {
		return time.Time{}
	}
	if ts.InfinityModifier != pgtype.Finite {
		return time.Time{}
	}
	return ts.Time
}

func ToPgTimestamptz(time time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:  time,
		Valid: true,
	}
}

func ToPgInt4(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *i, Valid: true}
}

func FromPgInt4(i pgtype.Int4) *int32 {
	if !i.Valid {
		return nil
	}
	val := i.Int32
	return &val
}
