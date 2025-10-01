import json
import hashlib
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
from datetime import datetime, timezone, timedelta

class CacheService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.cache_collection = db.ai_cache
        
    def _generate_cache_key(self, cache_type: str, data: Dict[str, Any]) -> str:
        """Generate a consistent cache key"""
        cache_data = {
            "type": cache_type,
            **data
        }
        cache_string = json.dumps(cache_data, sort_keys=True)
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    async def get_cached_result(self, cache_type: str, data: Dict[str, Any], max_age_hours: int = 24) -> Optional[Dict[str, Any]]:
        """Get cached result if exists and not expired"""
        try:
            cache_key = self._generate_cache_key(cache_type, data)
            
            cached_item = await self.cache_collection.find_one({"cache_key": cache_key})
            
            if cached_item:
                # Check if cache is still valid
                created_at = cached_item["created_at"]
                expiry_time = created_at + timedelta(hours=max_age_hours)
                
                if datetime.now(timezone.utc) < expiry_time:
                    logging.info(f"Cache HIT for {cache_type}: {cache_key[:10]}")
                    return cached_item["result"]
                else:
                    # Cache expired, delete it
                    await self.cache_collection.delete_one({"cache_key": cache_key})
                    logging.info(f"Cache EXPIRED for {cache_type}: {cache_key[:10]}")
            
            logging.info(f"Cache MISS for {cache_type}: {cache_key[:10]}")
            return None
            
        except Exception as e:
            logging.error(f"Cache get error: {e}")
            return None
    
    async def set_cached_result(self, cache_type: str, data: Dict[str, Any], result: Dict[str, Any]) -> None:
        """Store result in cache"""
        try:
            cache_key = self._generate_cache_key(cache_type, data)
            
            cache_item = {
                "cache_key": cache_key,
                "cache_type": cache_type,
                "input_data": data,
                "result": result,
                "created_at": datetime.now(timezone.utc)
            }
            
            # Upsert (update or insert)
            await self.cache_collection.replace_one(
                {"cache_key": cache_key},
                cache_item,
                upsert=True
            )
            
            logging.info(f"Cache STORED for {cache_type}: {cache_key[:10]}")
            
        except Exception as e:
            logging.error(f"Cache set error: {e}")
    
    async def clear_expired_cache(self, max_age_hours: int = 72) -> int:
        """Clean up expired cache entries"""
        try:
            expiry_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            
            result = await self.cache_collection.delete_many({
                "created_at": {"$lt": expiry_time}
            })
            
            logging.info(f"Cleared {result.deleted_count} expired cache entries")
            return result.deleted_count
            
        except Exception as e:
            logging.error(f"Cache cleanup error: {e}")
            return 0
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            total_entries = await self.cache_collection.count_documents({})
            
            # Count by type
            pipeline = [
                {"$group": {"_id": "$cache_type", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            
            type_counts = {}
            async for result in self.cache_collection.aggregate(pipeline):
                type_counts[result["_id"]] = result["count"]
            
            # Calculate cache size (approximate)
            sample = await self.cache_collection.find_one()
            avg_size = len(json.dumps(sample).encode()) if sample else 0
            estimated_size_mb = (total_entries * avg_size) / (1024 * 1024)
            
            return {
                "total_entries": total_entries,
                "type_counts": type_counts,
                "estimated_size_mb": round(estimated_size_mb, 2)
            }
            
        except Exception as e:
            logging.error(f"Cache stats error: {e}")
            return {"error": str(e)}

# Common cache types
CACHE_TYPES = {
    "SONG_SEARCH": "song_search",
    "INTELLIGENT_SEARCH": "intelligent_search", 
    "AI_REPERTOIRE": "ai_repertoire",
    "RECOMMENDATIONS": "recommendations",
    "INSTRUMENT_NOTATION": "instrument_notation"
}